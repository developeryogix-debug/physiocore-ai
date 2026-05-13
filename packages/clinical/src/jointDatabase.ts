import type { JointData } from './types.js';
import { shoulder } from './joints/shoulder.js';
import { knee } from './joints/knee.js';
import { lumbar } from './joints/lumbar.js';

export const jointDatabase: Record<string, JointData> = {
  shoulder,
  knee,
  lumbar,
};

export { shoulder, knee, lumbar };
export type { JointData };
