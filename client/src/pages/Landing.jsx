import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardPath } from '../utils/helpers.js';

const organizerSteps = [
  ['01', 'Publish your event', 'Share the audience, date, and sponsorship tiers that make your event unique.'],
  ['02', 'Meet relevant brands', 'Discover companies whose goals and audiences fit your event.'],
  ['03', 'Deliver together', 'Keep proposals, conversations, and sponsorship benefits in one place.'],
];

const sponsorSteps = [
  ['01', 'Find your audience', 'Explore events by city, category, dates, and sponsorship budget.'],
  ['02', 'Start a conversation', 'Send a proposal and refine the details directly with organizers.'],
  ['03', 'Track your impact', 'Follow delivery updates and proof for every agreed benefit.'],
];

const features = [
  {
    title: 'AI proposal drafting',
    description: 'Get a useful first draft, then make it yours before sending.',
    icon: <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2L12 8Z" />,
  },
  {
    title: 'Smart matching',
    description: 'Surface events that align with your audience, goals, and budget.',
    icon: <path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6M16 7h3v3" />,
  },
  {
    title: 'Real-time chat',
    description: 'Keep event conversations close to the proposal they belong to.',
    icon: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" />,
  },
  {
    title: 'Deliverable tracking',
    description: 'See agreed benefits move from delivery through sponsor approval.',
    icon: <path d="m5 12 4 4L19 6M4 4h8M4 8h5" />,
  },
  {
    title: 'Secure slots',
    description: 'Tier capacity is reserved safely when a proposal is accepted.',
    icon: <path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10Zm7 4v3" />,
  },
  {
    title: 'Helpful notifications',
    description: 'Stay up to date as proposals and deliverables need your attention.',
    icon: <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />,
  },
];

function LogoMark() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20">
      <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
        <path d="M5 18V6l7 7 7-7v12M8 18h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </span>
  );
}

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="-mx-4 -mt-8 space-y-16 pb-8 sm:-mx-6">
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4 py-16 sm:px-8 sm:py-24">
        <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 h-80 w-80 rounded-full bg-violet-200/50 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-20 -z-10 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sponsorships with a better fit
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Good events and great brands belong
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent"> together.</span>
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Fynd helps small brands discover events that fit their audience, while giving organizers a simple way to find sponsors and run every partnership.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link className="btn-primary" to={getDashboardPath(user.role)}>Go to dashboard</Link>
              ) : (
                <>
                  <Link className="btn-primary" to="/signup">I&apos;m an organizer</Link>
                  <Link className="btn-secondary" to="/signup">I&apos;m a sponsor</Link>
                </>
              )}
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-200/60 to-violet-200/60 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-2xl shadow-indigo-900/10 backdrop-blur sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <LogoMark />
                  <div>
                    <p className="font-semibold text-slate-900">The right fit</p>
                    <p className="text-sm text-slate-500">A partnership in motion</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Connected</span>
              </div>
              <div className="space-y-4 py-6">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">Community event</span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">92% match</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[92%] rounded-full bg-gradient-to-r from-indigo-600 to-violet-600" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Audience, goals, and budget aligned</p>
                </div>
                <div className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm text-white shadow-md">
                    We&apos;d love to support your next event.
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    Let&apos;s make it a great partnership.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-400">
                Message your event partner
                <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path d="m5 12 14-7-5 14-2-6-7-1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Simple from start to finish</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
          <p className="text-slate-600">A clear path from discovery to a partnership delivered.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { title: 'For organizers', steps: organizerSteps, color: 'indigo' },
            { title: 'For sponsors', steps: sponsorSteps, color: 'violet' },
          ].map((group) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7" key={group.title}>
              <h3 className="mb-5 text-xl font-semibold text-slate-900">{group.title}</h3>
              <ol className="space-y-4">
                {group.steps.map(([number, title, description]) => (
                  <li className="flex gap-4" key={number}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${group.color === 'indigo' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'} text-sm font-bold`}>
                      {number}
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-900">{title}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Everything in one place</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Built for better partnerships</h2>
          <p className="max-w-2xl text-slate-600">From the first introduction to the final approved deliverable, keep the important details together.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={feature.title}>
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                  {feature.icon}
                </svg>
              </span>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center sm:px-6">
        <Link aria-label="Fynd home" className="inline-flex" to="/"><LogoMark /></Link>
        <p className="mt-3 text-sm font-semibold text-slate-700">Fynd</p>
        <p className="mt-1 text-xs text-slate-500">Better partnerships start with the right fit.</p>
      </footer>
    </div>
  );
}
