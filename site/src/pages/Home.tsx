import { Human } from "../sections/Human";
import { SampleEvidence } from "../components/SampleEvidence";
import { Reveal } from "../components/Reveal";
import { Link } from "react-router-dom";

// Front page, for people rather than reviewers. The dense research scroll that
// used to live here is at /research, linked from here and from the nav.
export function Home() {
  return (
    <>
      <Human />

      <section className="hsec" id="try">
        <div className="wrap">
          <Reveal>
            <h2 className="h2">Hear it for yourself</h2>
            <p className="hsub">
              A real sentence, degraded the way dysarthria degrades speech, run
              through ordinary speech recognition and through ours. Nothing to
              install.
            </p>
          </Reveal>
          <SampleEvidence />
          <Reveal>
            <p className="hnote">
              Want the datasets, the training setup, the metric and the
              limitations?{" "}
              <Link to="/research">Read the research</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
