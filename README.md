# Chromecake

Chromecake will allow you to two-click stream media to a Chromecast (right click -> "Bake and cast"), with built-in image enhancement for anime/cartoon/line-art video, all in real time.

Support for streaming the codecs and formats used in anime fansub circles is poor, so this project aims to resolve that. Similar applications (such as Videostream for Chrome or Castnow) don't work well, especially with ASS subtitles; the vast majority of animations and complex styles do not work properly.

The default configuration is set up for streaming anime, on a Windows machine with an NVIDIA GPU:
```
 -  File input
 -> Avisynth script for bit depth correction, upscaling, sharpening, line thinning
 -> FFmpeg with the following settings:
    - HW accel decode
    - Video: HEVC encode through NVENC (Main10, p010le, slow preset, variable bitrate HQ, qmin:16 and qmax:12, RC lookahead 32, max bitrate 30Mbit/s)
    - Audio: Dolby Digital AC-3 @ 320kbps
    - Matroska container with frag_keyframe
    - Burned subtitles (defaults to English track); support for ASS and picture-based subs (hdmv_pgs_subtitle)
 -> Hosted server that serves the FFmpeg stream
 -> Chromecast
```

## Building
Prerequisites:
1. Install nodeJS + npm
2. Install yarn (`npm install -g yarn`)

Then, compile Chromecake:
1. Clone this repo
2. Install the TypeScript compiler (`npm install -g typescript`)
3. Install dependencies with `yarn install`
4. Build Chromecake to the `/out` directory with `tsc`
5. Manually copy over `template.avs` from `/src` to `/out` (to be fixed)

## Running
1. Ensure `ffmpeg` and `ffprobe` are installed and available in PATH
2. Install Avisynth (or disable enhancement in the source code)
3. Have an NVIDIA graphics card (or swap to the CPU encoder in the source code)
4. Run with `node path/to/chromecake/out/index.js input`, where `input` is either a file or a directory.

If you pass it a directory, Chromecake will attempt to play each file in the directory, and will skip to the next track when playback ends on the current file.  
I'll add command line flags for disabling enhancement / GPU encoding soon.

`AddToContextMenu.reg` in the root directory will add a "Bake and Cast" option to the right click menu of any file or directory, which will call Chromecake with the selected file. You will have to modify it to change the path to your Chromecake directory (and possible your nodeJS one too, it assumes that it is in Program Files).
