import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors, getDashboardPath } from '../utils/helpers.js';
import ErrorBox from '../components/ErrorBox.jsx';

const initialValues = {
  name: '',
  email: '',
  password: '',
  organization: '',
  city: '',
  orgType: 'college',
  industry: '',
  targetAudience: '',
  budgetMin: '',
  budgetMax: '',
  goals: '',
};

const fieldClass = 'input';

export default function Signup() {
  const [role, setRole] = useState('organizer');
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const updateField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setErrorMessage('');

    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
      organization: values.organization,
      city: values.city,
      role,
      ...(role === 'organizer'
        ? { orgType: values.orgType }
        : {
            industry: values.industry,
            targetAudience: values.targetAudience,
            budgetMin: Number(values.budgetMin),
            budgetMax: Number(values.budgetMax),
            goals: values.goals,
          }),
    };

    try {
      const user = await signup(payload);
      navigate(getDashboardPath(user.role), { replace: true });
    } catch (error) {
      const fieldErrorMap = fieldErrors(error);
      setErrors(fieldErrorMap);
      if (Object.keys(fieldErrorMap).length === 0) {
        setErrorMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name, label, type = 'text', options = {}) => (
    <label className="block text-sm font-medium" htmlFor={name}>
      {label}
      {type === 'textarea' ? (
        <textarea
          className={fieldClass}
          id={name}
          name={name}
          onChange={updateField}
          required
          rows={3}
          value={values[name]}
          {...options}
        />
      ) : type === 'select' ? (
        <select
          className={fieldClass}
          id={name}
          name={name}
          onChange={updateField}
          required
          value={values[name]}
          {...options}
        >
          {options.children}
        </select>
      ) : (
        <input
          className={fieldClass}
          id={name}
          name={name}
          onChange={updateField}
          required={options.required ?? true}
          type={type}
          value={values[name]}
          {...options}
        />
      )}
      {errors[name] && <span className="mt-1 block text-sm text-rose-600">{errors[name]}</span>}
    </label>
  );

  return (
    <section className="-my-8 flex min-h-[calc(100vh-9rem)] items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5 sm:p-8">
      <h1 className="page-title text-center">Create your account</h1>

      <div className="mx-auto flex w-fit rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Account type">
        <button
          aria-selected={role === 'organizer'}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-indigo-500 ${
            role === 'organizer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setRole('organizer')}
          role="tab"
          type="button"
        >
          I&apos;m an Organizer
        </button>
        <button
          aria-selected={role === 'sponsor'}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-indigo-500 ${
            role === 'sponsor' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setRole('sponsor')}
          role="tab"
          type="button"
        >
          I&apos;m a Sponsor
        </button>
      </div>

      {errorMessage && <ErrorBox message={errorMessage} />}

      <form className="space-y-4" onSubmit={submit}>
        {field('name', 'Name')}
        {field('email', 'Email', 'email')}
        {field('password', 'Password', 'password', {
          minLength: 8,
          autoComplete: 'new-password',
        })}
        {field('organization', 'Organization')}
        {field('city', 'City')}

        {role === 'organizer' ? (
          field('orgType', 'Organization type', 'select', {
            children: (
              <>
                <option value="college">College</option>
                <option value="club">Club</option>
                <option value="community">Community</option>
                <option value="other">Other</option>
              </>
            ),
          })
        ) : (
          <>
            {field('industry', 'Industry')}
            {field('targetAudience', 'Target audience', 'textarea')}
            <div className="grid gap-4 sm:grid-cols-2">
              {field('budgetMin', 'Minimum budget', 'number', { min: 0, step: 'any' })}
              {field('budgetMax', 'Maximum budget', 'number', { min: 0, step: 'any' })}
            </div>
            {field('goals', 'Goals', 'textarea')}
          </>
        )}

        <button className="btn-primary w-full" disabled={submitting} type="submit">
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      </div>
    </section>
  );
}
