# Chromecake

Chromecake will allow you to two-click stream media to a Chromecast (right click -> "Bake and cast"), with built-in image enhancement for anime/cartoon/line-art video.

Support for stream the codecs and formats used in anime fansub circles is poor, so this project aims to resolve that. Similar applications (such as Videostream for Chrome or Castnow) don't work well, especially with ASS subtitles; the vast majority of animations and complex styles do not work properly.

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

# Setup

First, install the prerequisites:
1. Ensure `ffmpeg` and `ffprobe` are installed and available in PATH.
2. Install Avisynth.
3. Buy an NVIDIA graphics card.

Then, install Chromecake:
1. Clone this repo
2. Install ts-node (`npm install -g ts-node`)
3. Run `ts-node <path to index.ts> input`, where `input` is any media file, or directory that contains multiple media files.

If you pass it a directory, Chromecake will attempt to play each file in the directory, and will skip to the next track when playback ends on the current file.
