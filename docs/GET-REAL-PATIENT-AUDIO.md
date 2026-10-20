# How to download the real Mandarin dysarthria recordings (MDSC / AISHELL-6B)

Written 2026-10-20. Takes about 10 minutes of form-filling, plus however long the download takes.

**What it is:** real recordings from 21 Mandarin speakers with dysarthria (cerebral palsy, Wilson's
disease), plus 25 healthy speakers. About 17 hours total, 16 kHz. Licence **CC BY-NC 4.0**:
free for non-commercial use, such as a hackathon, as long as we credit it.

## Steps

1. **Create a free Speechhome account** at https://www.speechhome.com/signup.
   Afterwards, find your **member ID** in your profile. The next form needs it.
2. **Open the dataset page** at https://www.aishelltech.com/AISHELL_6B and click the **Dataset**
   button. It goes to https://opendata.aishelltech.com/aishell-6b.
3. **Fill in the data application form:**
   - Speechhome member ID: from step 1
   - Licence type: choose the **non-commercial / CC BY-NC 4.0** option
   - Purpose (copy this if it asks): *"Academic research for the 2026 Presidential Hackathon
     (Taiwan). We evaluate speech recognition for Mandarin speakers with dysarthria and will
     cite the MDSC paper (arXiv 2406.10304)."*
4. **Download.** The links are MyAirBridge transfers (`mab.to/...`). Download every part.
5. **Unzip everything into one folder**, for example `~/Downloads/MDSC/`.
   Inside you should see folders like `train/`, `dev/`, `Control/`, `Uncontrol/`.
6. **Send Claude the folder path.** Claude then runs `python src/data_mdsc.py --inspect --root <path>`
   to check the layout before using anything.

## What happens with it

1. Test our model on the real patients first. That's the honest result the pitch needs, good or bad.
2. If it holds up, put a few real clips in the demo video, credited on screen as
   "MDSC / AISHELL-6B, CC BY-NC 4.0".
3. Never put the raw audio files in git or on the website. Small credited excerpts in the
   video only.

If a step looks different from this (the site changes sometimes), take a screenshot and send it.
