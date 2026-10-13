import { Hero } from "../components/Hero";
import { VoiceExploded } from "../components/VoiceExploded";
import { ToneGallery } from "../components/ToneGallery";
import { HelixPipeline } from "../components/HelixPipeline";
import { Evidence } from "../components/Evidence";
import { CodeFlythrough } from "../components/CodeFlythrough";
import { Demo } from "../sections/Demo";
import {
  Problem,
  Science,
  Confidentiality,
  Limitations,
  Team,
} from "../sections/Sections";

// The original scroll experience, unchanged. It moved off "/" because that
// page now has to speak to patients, clinicians and judges in the first ten
// seconds, and this one is written for readers who already want the detail.
export function Research() {
  return (
    <>
      <Hero />
      <VoiceExploded />
      <Problem />
      <ToneGallery />
      <Science />
      <HelixPipeline />
      <Evidence />
      <CodeFlythrough />
      <Demo />
      <Confidentiality />
      <Limitations />
      <Team />
    </>
  );
}
