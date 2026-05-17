/**
 * romData.ts — ROM test library, region map, and shared types.
 * All normative values: Norkin CC, White DJ. Measurement of Joint Motion. 4th Ed. 2016.
 */

export interface ROMTest {
  key: string; joint: string; movement: string; side: 'right' | 'left';
  view: 'anterior' | 'lateral-right' | 'lateral-left'; voiceCue: string;
  normalMin: number; normalMax: number; higherIsBetter: boolean;
  lmA: number; lmB: number; lmC: number;
  isCervLat?: boolean; isCervRot?: boolean;
  clinicalLabel: string; region: string;
}

export interface ROMResult {
  key: string; joint: string; movement: string; side: 'right' | 'left';
  angle: number; normalMin: number; normalMax: number;
  higherIsBetter: boolean; clinicalLabel: string;
  status: 'normal' | 'mild' | 'significant'; region: string;
}

export interface ROMInterp {
  summary: string;
  findings: { joint: string; finding: string }[];
  overallRisk: 'low' | 'moderate' | 'high';
  referral: boolean;
}

const T = (
  key: string, joint: string, movement: string, side: 'right' | 'left',
  view: 'anterior' | 'lateral-right' | 'lateral-left', voiceCue: string,
  normalMin: number, normalMax: number, higherIsBetter: boolean,
  lmA: number, lmB: number, lmC: number, clinicalLabel: string, region: string,
  isCervLat?: boolean, isCervRot?: boolean,
): ROMTest => ({ key, joint, movement, side, view, voiceCue, normalMin, normalMax, higherIsBetter, lmA, lmB, lmC, clinicalLabel, region, isCervLat, isCervRot });

export const ALL_TESTS: ROMTest[] = [
  // ── Cervical ──────────────────────────────────────────────────────────────────
  T('clf-r','Cervical','Lat. Flexion','right','anterior','Face camera. Tilt head to your RIGHT shoulder. Hold at maximum.',35,45,true,8,12,0,'35–45°','Head/Neck',true),
  T('clf-l','Cervical','Lat. Flexion','left','anterior','Return to centre. Tilt head to LEFT shoulder. Hold at maximum.',35,45,true,7,11,0,'35–45°','Head/Neck',true),
  T('crot-r','Cervical','Rotation','right','anterior','Face forward. Rotate head to look over your RIGHT shoulder. Hold.',60,80,true,0,11,12,'60–80°','Head/Neck',false,true),
  T('crot-l','Cervical','Rotation','left','anterior','Return. Rotate head to look over LEFT shoulder. Hold.',60,80,true,0,11,12,'60–80°','Head/Neck',false,true),

  // ── Shoulder ─────────────────────────────────────────────────────────────────
  T('sabd-r','Shoulder','Abduction','right','anterior','Raise RIGHT arm straight out to the side. Palm forward. Lift as high as possible.',155,180,true,24,12,14,'160–180°','Shoulder'),
  T('sabd-l','Shoulder','Abduction','left','anterior','Return. Raise LEFT arm straight out to the side. As high as you can.',155,180,true,23,11,13,'160–180°','Shoulder'),
  T('sflex-r','Shoulder','Flexion','right','lateral-right','RIGHT side faces camera. Raise right arm forward and up as high as possible.',155,180,true,24,12,14,'160–180°','Shoulder'),
  T('sflex-l','Shoulder','Flexion','left','lateral-left','LEFT side faces camera. Raise left arm forward and up as high as possible.',155,180,true,23,11,13,'160–180°','Shoulder'),
  T('sir-r','Shoulder','Int. Rotation','right','anterior','Bend RIGHT elbow to 90°. Keep elbow at side. Rotate forearm in toward your belly. Hold max.',60,90,false,16,14,12,'60–90°','Shoulder'),
  T('sir-l','Shoulder','Int. Rotation','left','anterior','Repeat with LEFT arm. Forearm in toward belly. Hold max.',60,90,false,15,13,11,'60–90°','Shoulder'),
  T('ser-r','Shoulder','Ext. Rotation','right','lateral-right','RIGHT side to camera. Arm at side, elbow bent 90°. Rotate forearm backward. Hold.',60,90,true,16,14,12,'60–90°','Shoulder'),
  T('ser-l','Shoulder','Ext. Rotation','left','lateral-left','LEFT side to camera. Elbow bent 90°. Rotate forearm backward. Hold.',60,90,true,15,13,11,'60–90°','Shoulder'),

  // ── Elbow ─────────────────────────────────────────────────────────────────────
  T('eflex-r','Elbow','Flexion','right','anterior','Lower arm. Bend RIGHT elbow — hand to shoulder.',30,45,false,12,14,16,'135–145°','Elbow'),
  T('eflex-l','Elbow','Flexion','left','anterior','Extend. Bend LEFT elbow — hand to shoulder.',30,45,false,11,13,15,'135–145°','Elbow'),

  // ── Trunk ─────────────────────────────────────────────────────────────────────
  T('tlf-r','Trunk','Lat. Flexion','right','anterior','Stand tall. Slide right hand down your right leg. Hold at maximum bend.',35,35,true,11,23,24,'35°','Trunk'),
  T('tlf-l','Trunk','Lat. Flexion','left','anterior','Return. Slide left hand down left leg. Hold at maximum.',35,35,true,12,24,23,'35°','Trunk'),

  // ── Hip ──────────────────────────────────────────────────────────────────────
  T('hflex-r','Hip','Flexion','right','lateral-right','RIGHT side faces camera. Lift RIGHT knee toward chest as high as you can. Back stays straight.',55,70,false,12,24,26,'110–125°','Hip'),
  T('hflex-l','Hip','Flexion','left','lateral-left','LEFT side faces camera. Lift LEFT knee toward chest as high as you can.',55,70,false,11,23,25,'110–125°','Hip'),
  T('hext-r','Hip','Extension','right','lateral-right','RIGHT side to camera. Stand tall. Extend RIGHT leg backward. Keep back straight. Hold.',10,20,false,12,24,26,'10–20°','Hip'),
  T('hext-l','Hip','Extension','left','lateral-left','LEFT side to camera. Extend LEFT leg backward. Keep back straight. Hold.',10,20,false,11,23,25,'10–20°','Hip'),

  // ── Knee ─────────────────────────────────────────────────────────────────────
  T('kflex-r','Knee','Flexion','right','lateral-right','Stand straight. Bend RIGHT knee — heel toward buttock.',30,50,false,24,26,28,'130–145°','Knee'),
  T('kflex-l','Knee','Flexion','left','lateral-left','Stand straight. Bend LEFT knee — heel toward buttock.',30,50,false,23,25,27,'130–145°','Knee'),

  // ── Ankle ────────────────────────────────────────────────────────────────────
  T('adf-r','Ankle','Dorsiflexion','right','lateral-right','RIGHT side to camera. Stand flat. Slowly bend ankle bringing toes up toward shin. Hold.',100,110,true,26,28,32,'20° DF','Ankle'),
  T('adf-l','Ankle','Dorsiflexion','left','lateral-left','LEFT side to camera. Bring toes up toward shin. Hold at maximum.',100,110,true,25,27,31,'20° DF','Ankle'),
  T('apf-r','Ankle','Plantarflexion','right','lateral-right','RIGHT side. Rise up on toes as high as possible. Hold.',30,45,false,26,28,32,'50° PF','Ankle'),
  T('apf-l','Ankle','Plantarflexion','left','lateral-left','LEFT side. Rise on toes as high as possible. Hold.',30,45,false,25,27,31,'50° PF','Ankle'),
];

export const REGION_MAP: Record<string, string[]> = {
  'Head/Neck': ['clf-r','clf-l','crot-r','crot-l'],
  'Shoulder':  ['sabd-r','sabd-l','sflex-r','sflex-l','sir-r','sir-l','ser-r','ser-l'],
  'Elbow':     ['eflex-r','eflex-l'],
  'Wrist':     [],
  'Trunk':     ['tlf-r','tlf-l'],
  'Hip':       ['hflex-r','hflex-l','hext-r','hext-l'],
  'Knee':      ['kflex-r','kflex-l'],
  'Ankle':     ['adf-r','adf-l','apf-r','apf-l'],
  'Foot':      [],
};

export const GRID_REGIONS = ['Head/Neck','Shoulder','Elbow','Wrist','Trunk','Hip','Knee','Ankle','Foot'] as const;
export const NEW_BADGE_REGIONS = new Set(['Head/Neck','Shoulder','Trunk','Hip','Ankle']);
export const PROX_DIST_ORDER = ['Cervical','Shoulder','Elbow','Wrist','Trunk','Hip','Knee','Ankle','Foot'];

export function buildQueue(regions: Set<string>): ROMTest[] {
  const keys = new Set(GRID_REGIONS.flatMap(r => regions.has(r) ? (REGION_MAP[r] ?? []) : []));
  return ALL_TESTS
    .filter(t => keys.has(t.key))
    .sort((a, b) => PROX_DIST_ORDER.indexOf(a.joint) - PROX_DIST_ORDER.indexOf(b.joint));
}

export function romStatus(angle: number, t: ROMTest): 'normal' | 'mild' | 'significant' {
  if (t.higherIsBetter) return angle >= t.normalMin ? 'normal' : angle >= t.normalMin * 0.8 ? 'mild' : 'significant';
  return angle <= t.normalMax ? 'normal' : angle <= t.normalMax * 1.3 ? 'mild' : 'significant';
}

export const statusClr = (s: 'normal' | 'mild' | 'significant') =>
  s === 'normal' ? '#00D4AA' : s === 'mild' ? '#FFB830' : '#FF4444';

export const BONES: [number, number][] = [
  [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],[0,7],[0,8],
];
