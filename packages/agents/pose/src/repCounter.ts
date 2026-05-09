type Stage = 'up' | 'down' | 'transition';

/**
 * Counts exercise repetitions based on joint angle threshold crossings.
 *
 * A rep is counted when the joint angle moves from the "up" position (above
 * upThreshold) through the "down" position (below downThreshold) and back to
 * the "up" position — or vice versa, depending on exercise direction.
 *
 * The state machine:
 *   - Stage "up":   angle >= upThreshold
 *   - Stage "down": angle <= downThreshold
 *   - Stage "transition": angle between downThreshold and upThreshold
 *
 * A complete rep is counted each time the stage transitions from "down" -> "up".
 */
export class RepCounter {
  private readonly joint: string;
  private readonly upThreshold: number;
  private readonly downThreshold: number;

  private count: number = 0;
  private stage: Stage = 'up';

  constructor(joint: string, upThreshold: number, downThreshold: number) {
    if (downThreshold >= upThreshold) {
      throw new Error(
        `RepCounter for "${joint}": downThreshold (${downThreshold}) must be less than upThreshold (${upThreshold})`,
      );
    }
    this.joint = joint;
    this.upThreshold = upThreshold;
    this.downThreshold = downThreshold;
  }

  /**
   * Updates the state machine with the current angle reading.
   * Increments the rep count when a full down->up transition is detected.
   */
  update(angle: number): void {
    const previousStage = this.stage;

    if (angle >= this.upThreshold) {
      this.stage = 'up';
    } else if (angle <= this.downThreshold) {
      this.stage = 'down';
    } else {
      this.stage = 'transition';
    }

    // Count a rep when we come back up from a down position
    if (previousStage === 'down' && this.stage === 'up') {
      this.count += 1;
    }
  }

  /** Returns the total rep count accumulated since construction or last reset. */
  getCount(): number {
    return this.count;
  }

  /** Resets the rep count and stage to initial values. */
  reset(): void {
    this.count = 0;
    this.stage = 'up';
  }

  /** Returns the current stage of the movement. */
  getStage(): Stage {
    return this.stage;
  }

  /** Returns the joint this counter is tracking (useful for diagnostics). */
  getJoint(): string {
    return this.joint;
  }
}
