/** The vertical band in which the camera frames play. Art continues behind UI. */
export function playArea(height:number,bottom:number,hudBottom=0):{top:number;height:number} {
  const end=Math.max(1,Math.min(height,Number.isFinite(bottom)?bottom:height));
  const top=Math.max(0,Math.min(hudBottom>0?hudBottom+12:0,Math.max(0,end-80)));
  return {top,height:end-top};
}
