import Image from "next/image";

import { publicProjects } from "@/config/public-projects";

const githubProfile = "https://github.com/Zhang-ZhengHao";

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header" id="top">
        <div className="shell header-inner">
          <a className="wordmark" href="#top" aria-label="Zhenghao Zhang home">
            Zhenghao Zhang
          </a>
          <nav aria-label="Primary navigation">
            <a href="#work">Work</a>
            <a href="#approach">Approach</a>
            <a href={githubProfile} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="preview-state">
                Work in progress: project intake is not open yet.
              </p>
              <h1 id="hero-title">
                Full-stack tools for <span>business workflows.</span>
              </h1>
              <p className="hero-summary" data-testid="hero-supporting-copy">
                I build internal tools, integrations, and workflow automation
                with clear scope, testable delivery, and documented production
                boundaries.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#work">
                  View selected work
                </a>
                <a
                  className="button button-secondary"
                  href={githubProfile}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View GitHub profile
                </a>
              </div>
            </div>

            <figure className="hero-evidence">
              <div className="hero-image-frame">
                <Image
                  alt="CommerceOps Desk manager view with an exception queue, refund case details, assignment, notes, and resolution controls."
                  height={855}
                  priority
                  sizes="(max-width: 980px) 100vw, 48vw"
                  src="/images/projects/commerceops-desk.png"
                  width={1152}
                />
              </div>
              <figcaption>
                Working CommerceOps interface. All data shown is synthetic.
              </figcaption>
            </figure>
          </div>
        </section>

        <aside className="preview-boundary" aria-label="Preview boundary">
          <div className="shell preview-boundary-inner">
            <strong>Foundation preview</strong>
            <p>
              This preview does not collect project briefs or accept payments.
            </p>
          </div>
        </aside>

        <section
          className="work-section"
          id="work"
          aria-labelledby="work-title"
        >
          <div className="shell">
            <div className="section-heading">
              <p className="section-kicker">Open work samples</p>
              <h2 id="work-title">Selected work</h2>
              <p>
                Each link opens a public repository with its tests and known
                limits. The screenshots show implemented interfaces with
                synthetic data.
              </p>
            </div>

            <div className="project-grid">
              {publicProjects.map((project, index) => (
                <article
                  className={`project project-${index + 1}`}
                  key={project.repositoryUrl}
                >
                  <div className="project-image">
                    <Image
                      alt={project.image.alt}
                      height={project.image.height}
                      sizes={
                        index === 0
                          ? "(max-width: 980px) 100vw, 58vw"
                          : "(max-width: 700px) 100vw, 42vw"
                      }
                      src={project.image.src}
                      width={project.image.width}
                    />
                  </div>
                  <div className="project-copy">
                    <p className="evidence-label">{project.evidenceLabel}</p>
                    <h3>{project.title}</h3>
                    <p className="project-stack">{project.stack}</p>
                    <p>{project.description}</p>
                    <p className="project-boundary">{project.boundary}</p>
                    <a
                      href={project.repositoryUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View repository
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="approach-section"
          id="approach"
          aria-labelledby="approach-title"
        >
          <div className="shell">
            <div className="section-heading section-heading-compact">
              <h2 id="approach-title">How I would structure the work</h2>
              <p>
                For a new project, I would start with one well-defined workflow
                and agree on what a working result needs to prove.
              </p>
            </div>

            <ol className="approach-list">
              <li>
                <h3>Share the workflow</h3>
                <p>
                  Describe the current process, users, constraints, and the
                  decision that matters.
                </p>
              </li>
              <li>
                <h3>Review the scope</h3>
                <p>
                  Agree on outcomes, boundaries, risks, acceptance checks, and a
                  staged delivery plan.
                </p>
              </li>
              <li>
                <h3>Build with evidence</h3>
                <p>
                  Ship tested code, deployment notes, honest limitations, and a
                  reproducible handoff.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="scope-section" aria-labelledby="scope-title">
          <div className="shell scope-grid">
            <div className="scope-intro">
              <h2 id="scope-title">Focused work, clear boundaries</h2>
              <p>
                Best suited to internal tools, API-backed workflows,
                integrations, and automation where reliability and operator
                control matter.
              </p>
            </div>
            <div className="scope-detail">
              <h3>Typical project shape</h3>
              <ul>
                <li>
                  One business workflow with a named user and measurable
                  acceptance checks
                </li>
                <li>
                  A web interface, service boundary, integration, or
                  data-processing pipeline
                </li>
                <li>
                  Tests, deployment instructions, and explicit operational
                  limits
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          className="contact-section"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className="shell contact-grid">
            <div>
              <p className="section-kicker">Current status</p>
              <h2 id="contact-title">Project intake</h2>
            </div>
            <div className="contact-copy">
              <p>
                The intake form is not available in this preview. If an existing
                X or hiring-platform conversation brought you here, please
                continue in that same thread. Otherwise, use the GitHub profile
                below to review my work.
              </p>
              <p>
                The v0.1 release will open a limited, email-verified inquiry
                form only after its privacy, deployment, and security checks
                pass.
              </p>
              <a href={githubProfile} rel="noopener noreferrer" target="_blank">
                Review the public GitHub profile
              </a>
            </div>
            <p className="safety-note">
              Do not send passwords, API keys, production data, or payment
              details. Do not send identity documents or health information.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>
            Foundation preview. No real inquiries or payments are accepted by
            this revision.
          </p>
          <a href={githubProfile} rel="noopener noreferrer" target="_blank">
            GitHub profile
          </a>
        </div>
      </footer>
    </>
  );
}
