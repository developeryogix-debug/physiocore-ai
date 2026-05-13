import type { JointData } from './types.js';
import { shoulder } from './joints/shoulder.js';
import { knee }     from './joints/knee.js';
import { lumbar }   from './joints/lumbar.js';
import { elbow }    from './joints/elbow.js';
import { wrist }    from './joints/wrist.js';
import { hip }      from './joints/hip.js';
import { ankle }    from './joints/ankle.js';
import { cervical } from './joints/cervical.js';
import { thoracic } from './joints/thoracic.js';
import { si }       from './joints/si.js';
import { tmj }      from './joints/tmj.js';
import { foot }     from './joints/foot.js';

export const jointDatabase: Record<string, JointData> = {
  shoulder,
  knee,
  lumbar,
  elbow,
  wrist,
  hip,
  ankle,
  cervical,
  thoracic,
  si,
  tmj,
  foot,
};

export { shoulder, knee, lumbar, elbow, wrist, hip, ankle, cervical, thoracic, si, tmj, foot };
export type { JointData };
