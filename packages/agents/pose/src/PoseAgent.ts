import type {
  AgentContext,
  AgentResult,
  AgentMetadata,
  PoseAnalysis,
  PoseFrame,
  PoseDeviation,
  PoseLandmark,
} from '@physiocore/types';
import type { PoseAgentConfig } from './types.js';
import { EXERCISE_REFERENCE_ANGLES } from './types.js';
import { calculateJointAngles } from './angleUtils.js';
import { RepCounter } from './repCounter.js';

const DEFAULT_CONFIG: PoseAgentConfig = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Rep counting thresholds per exercise: [upThreshold, downThreshold]
const REP_THRESHOLDS: Record<string, { joint: string; up: number; down: number }> = {
  squat: { joint: 'left_knee', up: 160, down: 100 },
  deadlift: { joint: 'left_hip', up: 160, down: 70 },
  pushup: { joint: 'left_elbow', up: 160, down: 90 },
  lunge: { joint: 'left_knee', up: 160, down: 100 },
  shoulder_press: { joint: 'left_elbow', up: 160, down: 90 },
};

/**
 * MediaPipe PoseLandmarker result shape (subset used here).
 * We avoid importing the full MediaPipe types to keep the agent portable.
 */
interface MPLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface MPPoseResult {
  landmarks: MPLandmark[][];
  worldLandmarks: MPLandmark[][];
}

interface MPPoseLandmarkerModule {
  PoseLandmarker: {
    createFromOptions(
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate: string };
        runningMode: string;
        numPoses: number;
        minPoseDetectionConfidence: number;
        minPosePresenceConfidence: number;
        minTrackingConfidence: number;
      },
    ): Promise<MPPoseLandmarkerInstance>;
    POSE_CONNECTIONS: unknown;
  };
}

interface MPPoseLandmarkerInstance {
  detectForVideo(
    image: HTMLVideoElement | HTMLImageElement,
    timestampMs: number,
  ): MPPoseResult;
  detect(image: HTMLVideoElement | HTMLImageElement): MPPoseResult;
  close(): void;
}

interface MPFilesetResolverModule {
  FilesetResolver: {
    forVisionTasks(wasmFilePath: string): Promise<unknown>;
  };
}

function toLandmarks(raw: MPLandmark[]): PoseLandmark[] {
  return raw.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? 1,
    name: '',
  }));
}

export class PoseAgent {
  private readonly agentId = 'pose-agent';
  private readonly version = '1.0.0';
  private config: PoseAgentConfig;
  private poseLandmarker: MPPoseLandmarkerInstance | null = null;
  private repCounter: RepCounter;
  private frameBuffer: PoseFrame[] = [];
  private frameIndex = 0;

  constructor(config?: Partial<PoseAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Default rep counter for squats; reconfigured per session
    this.repCounter = new RepCounter('left_knee', 160, 100);
  }

  /**
   * Initialises the MediaPipe PoseLandmarker. Must be called before any
   * analyzeFrame or analyzeSession calls.
   */
  async initialize(): Promise<void> {
    // Dynamic imports allow tree-shaking in bundlers and avoid SSR issues
    const visionModule = await import('@mediapipe/tasks-vision') as unknown as
      MPFilesetResolverModule & MPPoseLandmarkerModule;

    const { FilesetResolver, PoseLandmarker } = visionModule;

    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: this.config.modelAssetPath,
        delegate: 'GPU',
      },
      runningMode: this.config.runningMode,
      numPoses: this.config.numPoses,
      minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
      minPosePresenceConfidence: this.config.minPosePresenceConfidence,
      minTrackingConfidence: this.config.minTrackingConfidence,
    });
  }

  /**
   * Runs pose detection on a single video or image frame.
   * Returns an AgentResult containing a PoseFrame with landmarks and joint angles.
   */
  async analyzeFrame(
    imageElement: HTMLVideoElement | HTMLImageElement,
    context: AgentContext,
  ): Promise<AgentResult<PoseFrame>> {
    const startTime = Date.now();

    if (!this.poseLandmarker) {
      return this.buildError(
        startTime,
        'POSE_AGENT_UNINITIALISED',
        'PoseAgent not initialized. Call initialize() first.',
        false,
      );
    }

    const timestampMs = Date.now();

    let result: MPPoseResult;
    if (this.config.runningMode === 'VIDEO') {
      result = this.poseLandmarker.detectForVideo(imageElement, timestampMs);
    } else {
      result = this.poseLandmarker.detect(imageElement);
    }

    const rawLandmarks = result.landmarks[0] ?? [];
    const rawWorldLandmarks = result.worldLandmarks[0] ?? [];

    const landmarks = toLandmarks(rawLandmarks);
    const worldLandmarks = toLandmarks(rawWorldLandmarks);

    const jointAngles = calculateJointAngles(landmarks);

    const frame: PoseFrame = {
      landmarks,
      worldLandmarks,
      timestamp: timestampMs,
    };

    this.frameBuffer.push(frame);
    this.frameIndex += 1;

    // Update rep counter with primary joint angle if available
    const primaryAngle = jointAngles['left_knee'];
    if (primaryAngle !== undefined) {
      this.repCounter.update(primaryAngle);
    }

    return this.buildResult(frame, startTime);
  }

  /**
   * Analyses a completed session's frames to produce a PoseAnalysis:
   * - Computes per-frame joint angles
   * - Counts repetitions
   * - Detects form deviations against reference angles
   * - Computes an overall form score (0–100)
   */
  async analyzeSession(
    frames: PoseFrame[],
    exerciseName: string,
    context: AgentContext,
  ): Promise<AgentResult<PoseAnalysis>> {
    const startTime = Date.now();

    if (frames.length === 0) {
      const empty: PoseAnalysis = {
        frames: [],
        exerciseDetected: exerciseName || null,
        repCount: 0,
        formScore: 0,
        jointAngles: {},
        deviations: [],
      };
      return this.buildResult(empty, startTime);
    }

    // Configure rep counter for this exercise
    const thresholds = REP_THRESHOLDS[exerciseName];
    if (thresholds !== undefined) {
      this.repCounter = new RepCounter(thresholds.joint, thresholds.up, thresholds.down);
    } else {
      this.repCounter = new RepCounter('left_knee', 160, 100);
    }

    // Compute joint angles per frame and feed into rep counter
    const framesWithAngles: PoseFrame[] = frames.map((frame) => {
      const angles = calculateJointAngles(frame.landmarks);
      const primaryJoint = thresholds?.joint ?? 'left_knee';
      const primaryAngle = angles[primaryJoint];
      if (primaryAngle !== undefined) {
        this.repCounter.update(primaryAngle);
      }
      return { ...frame };
    });

    // Average joint angles across all frames
    const angleSums: Record<string, number> = {};
    const angleCounts: Record<string, number> = {};

    for (const frame of framesWithAngles) {
      const angles = calculateJointAngles(frame.landmarks);
      for (const [joint, angle] of Object.entries(angles)) {
        angleSums[joint] = (angleSums[joint] ?? 0) + angle;
        angleCounts[joint] = (angleCounts[joint] ?? 0) + 1;
      }
    }

    const averageJointAngles: Record<string, number> = {};
    for (const joint of Object.keys(angleSums)) {
      const sum = angleSums[joint];
      const count = angleCounts[joint];
      if (sum !== undefined && count !== undefined && count > 0) {
        averageJointAngles[joint] = sum / count;
      }
    }

    const deviations = this.detectDeviations(averageJointAngles, exerciseName);
    const formScore = this.computeFormScore(framesWithAngles, exerciseName);

    const analysis: PoseAnalysis = {
      frames: framesWithAngles,
      exerciseDetected: exerciseName,
      repCount: this.repCounter.getCount(),
      formScore,
      jointAngles: averageJointAngles,
      deviations,
    };

    return this.buildResult(analysis, startTime);
  }

  /**
   * Computes a form score (0–100) based on how consistently joint angles
   * fall within the reference ranges across all frames.
   *
   * Score = (frames with all key angles in range / total frames) * 100
   * Deducted by severity-weighted deviation count when no reference is found.
   */
  private computeFormScore(frames: PoseFrame[], exerciseName: string): number {
    const referenceAngles = EXERCISE_REFERENCE_ANGLES[exerciseName];

    if (referenceAngles === undefined || frames.length === 0) {
      // No reference: return a neutral score
      return 70;
    }

    const joints = Object.keys(referenceAngles);
    let framesInRange = 0;

    for (const frame of frames) {
      const angles = calculateJointAngles(frame.landmarks);
      let allInRange = true;

      for (const joint of joints) {
        const ref = referenceAngles[joint];
        const angle = angles[joint];
        if (ref === undefined || angle === undefined) continue;
        if (angle < ref.min || angle > ref.max) {
          allInRange = false;
          break;
        }
      }

      if (allInRange) framesInRange += 1;
    }

    return Math.round((framesInRange / frames.length) * 100);
  }

  /**
   * Compares average joint angles against the reference ranges for the given
   * exercise and returns a list of deviations with severity and corrections.
   */
  private detectDeviations(
    jointAngles: Record<string, number>,
    exerciseName: string,
  ): PoseDeviation[] {
    const referenceAngles = EXERCISE_REFERENCE_ANGLES[exerciseName];

    if (referenceAngles === undefined) {
      return [];
    }

    const deviations: PoseDeviation[] = [];

    for (const [joint, ref] of Object.entries(referenceAngles)) {
      const actual = jointAngles[joint];
      if (actual === undefined) continue;

      if (actual < ref.min || actual > ref.max) {
        const expected = actual < ref.min ? ref.min : ref.max;
        const delta = Math.abs(actual - expected);

        let severity: PoseDeviation['severity'];
        if (delta <= 10) {
          severity = 'minor';
        } else if (delta <= 25) {
          severity = 'moderate';
        } else {
          severity = 'severe';
        }

        deviations.push({
          joint,
          expectedAngle: expected,
          actualAngle: actual,
          severity,
          recommendation: ref.correction,
        });
      }
    }

    return deviations;
  }

  private buildResult<T>(data: T, startTime: number): AgentResult<T> {
    const metadata: AgentMetadata = {
      agentId: this.agentId,
      agentVersion: this.version,
      processingMs: Date.now() - startTime,
    };
    return { success: true, data, metadata };
  }

  private buildError<T>(
    startTime: number,
    code: string,
    message: string,
    retryable: boolean,
  ): AgentResult<T> {
    const metadata: AgentMetadata = {
      agentId: this.agentId,
      agentVersion: this.version,
      processingMs: Date.now() - startTime,
    };
    return {
      success: false,
      error: { code, message, retryable },
      metadata,
    };
  }

  /**
   * Disposes the underlying MediaPipe landmarker to free GPU/WASM resources.
   */
  dispose(): void {
    if (this.poseLandmarker !== null) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
  }
}
