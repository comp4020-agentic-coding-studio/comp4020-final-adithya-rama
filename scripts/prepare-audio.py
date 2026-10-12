"""Prepare small CC0 audio clips. Run with py7zr + imageio-ffmpeg installed.
Source archives stay ignored under .data; production uses only public/audio.
See public/audio/CREDITS.md for provenance; none are Mini Militia recordings.
"""
from pathlib import Path
import array, hashlib, json, subprocess, sys
import imageio_ffmpeg
ROOT = Path(__file__).resolve().parents[1]
source = ROOT/'.data/audio-source'
dest = ROOT/'src/client/public/audio'
dest.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
clips = {
 'pistol': ('Prepared SFX Library/1911/A_42P.wav', .65),
 'silenced': ('Prepared SFX Library/Ruger Mark III/R_35P.wav', .36),
 'revolver': ('Prepared SFX Library/Smith & Wesson 642/V_27P.wav', .9),
 'smg': ('Prepared SFX Library/Carl Gustav M45/G_31P.wav', .32),
 'machine-pistol': ('Prepared SFX Library/PPSh/P_30P.wav', .3),
 'ak': ('Prepared SFX Library/AK-47/C_28P.wav', .65),
 'carbine': ('Prepared SFX Library/AR-15/D_32P.wav', .5),
 'marksman': ('Prepared SFX Library/SKS/U_14P.wav', .9),
 'sniper': ('Prepared SFX Library/Tikka/W_29P.wav', 1.1),
 'shotgun': ('Prepared SFX Library/Nova/O_21P.wav', .85),
 'auto-shotgun': ('Prepared SFX Library/CD/H_21P.wav', .6),
 'hurt-1': ('voices/1.mp3', .6),
 'hurt-2': ('voices/2.mp3', .6),
 'death-1': ('voices/6.mp3', 1.6),
 'death-2': ('voices/8.mp3', 1.6),
 'death-3': ('voices/10.mp3', 1.6),
}
manifest = []
for name,(relative,limit) in clips.items():
    file=source/relative
    pcm=subprocess.check_output([ffmpeg,'-v','error','-i',str(file),'-f','f32le','-ac','1','-ar','44100','-'])
    values=array.array('f',pcm)
    if sys.byteorder!='little': values.byteswap()
    peak=max(abs(n) for n in values)
    threshold=peak*(.015 if name.startswith(('hurt','death')) else .035)
    start=max(0,next(i for i,n in enumerate(values) if abs(n)>threshold)-132)
    stop=min(len(values),start+int(limit*44100))
    clip=values[start:stop]
    gain=.82/max(abs(n) for n in clip)
    for i in range(len(clip)):
        # Fast attack preserved, gentle final fade prevents cutoff clicks.
        clip[i]*=gain*min(1, (len(clip)-i)/2205)
    if sys.byteorder!='little': clip.byteswap()
    target=dest/(name+'.ogg')
    subprocess.run([ffmpeg,'-v','error','-y','-f','f32le','-ar','44100','-ac','1','-i','-','-c:a','libvorbis','-q:a','4',str(target)],input=clip.tobytes(),check=True)
    manifest.append(dict(file=target.name,source=relative,sourceSha256=hashlib.sha256(file.read_bytes()).hexdigest(),onsetSeconds=round(start/44100,4),durationSeconds=round(len(clip)/44100,4),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size))
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(clips=len(manifest),totalBytes=sum(n['bytes'] for n in manifest)),indent=2))
