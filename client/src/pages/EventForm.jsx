import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import { fieldErrors, toDateInputValue } from '../utils/helpers.js';

const categories = ['tech', 'cultural', 'sports', 'business', 'music', 'social', 'other'];

const blankForm = {
  title: '',
  description: '',
  category: 'tech',
  city: '',
  venue: '',
  startDate: '',
  endDate: '',
  expectedFootfall: '',
  audienceProfile: '',
  tiers: [],
};

const inputClass = 'input';

function tierErrorMessage(details, tierIndex, field) {
  const issue = details?.find((detail) => (
    Array.isArray(detail.path) &&
    detail.path[0] === 'tiers' &&
    Number(detail.path[1]) === tierIndex &&
    detail.path[2] === field
  ));
  return issue?.message;
}

export default function EventForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [errorDetails, setErrorDetails] = useState([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [showAiPrefill, setShowAiPrefill] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiFilled, setAiFilled] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    let active = true;
    api.get(`/events/${id}`)
      .then(({ data }) => {
        if (!active) return;
        const event = data.event;
        if (event.status === 'closed') {
          setLoadingError('Closed events cannot be edited');
          return;
        }
        setForm({
          title: event.title,
          description: event.description,
          category: event.category,
          city: event.city,
          venue: event.venue,
          startDate: toDateInputValue(event.startDate),
          endDate: toDateInputValue(event.endDate),
          expectedFootfall: String(event.expectedFootfall),
          audienceProfile: event.audienceProfile,
          status: event.status,
          tiers: event.tiers.map((tier) => ({
            _id: tier._id,
            name: tier.name,
            price: String(tier.price),
            slots: String(tier.slots),
            slotsFilled: tier.slotsFilled,
            benefitsText: tier.benefits.join('\n'),
          })),
        });
        setBannerUrl(event.bannerUrl ?? '');
      })
      .catch((error) => {
        if (active) setLoadingError(error.status === 404 ? 'Event not found' : error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEditing]);

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const setTierField = (index, event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) => (
        tierIndex === index ? { ...tier, [name]: value } : tier
      )),
    }));
  };

  const addTier = () => {
    setForm((current) => ({
      ...current,
      tiers: [...current.tiers, {
        name: '',
        price: '',
        slots: '1',
        slotsFilled: 0,
        benefitsText: '',
      }],
    }));
  };

  const removeTier = (index) => {
    setForm((current) => ({
      ...current,
      tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index),
    }));
  };

  const autoFillWithAI = async () => {
    setAiLoading(true);
    setAiError('');
    setAiFilled(false);
    try {
      const { data } = await api.post('/ai/extract-event', { text: aiText });
      const extracted = data.event;
      const description = typeof extracted.description === 'string'
        && extracted.description.trim()
        ? extracted.description
        : aiText.trim();
      setForm((current) => {
        const updates = {};
        for (const field of [
          'title',
          'description',
          'category',
          'city',
          'venue',
          'startDate',
          'endDate',
          'expectedFootfall',
          'audienceProfile',
        ]) {
          if (field === 'description') {
            updates.description = description.slice(0, 3000);
          } else if (extracted[field] !== undefined && extracted[field] !== null) {
            updates[field] = field === 'expectedFootfall'
              ? String(extracted[field])
              : extracted[field];
          }
        }

        if (current.tiers.length === 0 && Array.isArray(extracted.tiers)) {
          updates.tiers = extracted.tiers.map((tier) => ({
            name: tier.name ?? '',
            price: tier.price === null || tier.price === undefined ? '' : String(tier.price),
            slots: tier.slots === null || tier.slots === undefined ? '1' : String(tier.slots),
            slotsFilled: 0,
            benefitsText: Array.isArray(tier.benefits) ? tier.benefits.join('\n') : '',
          }));
        }
        return { ...current, ...updates };
      });
      setAiFilled(true);
    } catch (error) {
      setAiError(error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setErrorDetails([]);
    setErrorMessage('');

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      city: form.city,
      venue: form.venue,
      startDate: form.startDate,
      endDate: form.endDate,
      expectedFootfall: Number(form.expectedFootfall),
      audienceProfile: form.audienceProfile,
      tiers: form.tiers.map((tier) => ({
        ...(tier._id ? { _id: tier._id } : {}),
        name: tier.name,
        price: Number(tier.price),
        slots: Number(tier.slots),
        benefits: tier.benefitsText.split('\n').map((benefit) => benefit.trim()).filter(Boolean),
      })),
    };

    try {
      const { data } = isEditing
        ? await api.put(`/events/${id}`, payload)
        : await api.post('/events', payload);
      if (isEditing) {
        navigate('/organizer');
      } else {
        navigate(`/organizer/events/${data.event._id}/edit`, { replace: true });
      }
    } catch (error) {
      setErrors(fieldErrors(error));
      setErrorDetails(error.details ?? []);
      if (!error.details?.length) setErrorMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Choose a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be 5 MB or smaller');
      return;
    }

    setErrorMessage('');
    setUploading(true);
    const body = new FormData();
    body.append('banner', file);
    try {
      const { data } = await api.post(`/events/${id}/banner`, body);
      setBannerUrl(data.event.bannerUrl);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loader />;
  if (loadingError) {
    return (
      <div className="space-y-4">
        <ErrorBox message={loadingError} />
        <Link className="btn-secondary w-fit" to="/organizer">Back to dashboard</Link>
      </div>
    );
  }

  if (isEditing && form.status === 'closed') {
    return <ErrorBox message="Closed events cannot be edited" />;
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <h1 className="page-title">{isEditing ? 'Edit event' : 'Create event'}</h1>
      {errorMessage && <ErrorBox message={errorMessage} />}
      <form className="space-y-6" onSubmit={saveEvent}>
        <section className="card space-y-5">
          <h2 className="text-xl font-semibold text-slate-900">Basic info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label" htmlFor="title">
              Title
              <input className={inputClass} id="title" name="title" onChange={setField} required value={form.title} />
              {errors.title && <span className="mt-1 block text-sm text-rose-600">{errors.title}</span>}
            </label>
            <label className="label" htmlFor="category">
              Category
              <select className={inputClass} id="category" name="category" onChange={setField} value={form.category}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {errors.category && <span className="mt-1 block text-sm text-rose-600">{errors.category}</span>}
            </label>
            <label className="label sm:col-span-2" htmlFor="description">
              Description
              <textarea className={inputClass} id="description" name="description" onChange={setField} required rows={4} value={form.description} />
              {errors.description && <span className="mt-1 block text-sm text-rose-600">{errors.description}</span>}
            </label>
          </div>
        </section>

        <section className="card space-y-5">
          <h2 className="text-xl font-semibold text-slate-900">Date and place</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label" htmlFor="city">
              City
              <input className={inputClass} id="city" name="city" onChange={setField} required value={form.city} />
              {errors.city && <span className="mt-1 block text-sm text-rose-600">{errors.city}</span>}
            </label>
            <label className="label" htmlFor="venue">
              Venue
              <input className={inputClass} id="venue" name="venue" onChange={setField} required value={form.venue} />
              {errors.venue && <span className="mt-1 block text-sm text-rose-600">{errors.venue}</span>}
            </label>
            <label className="label" htmlFor="startDate">
              Start date
              <input className={inputClass} id="startDate" name="startDate" onChange={setField} required type="date" value={form.startDate} />
              {errors.startDate && <span className="mt-1 block text-sm text-rose-600">{errors.startDate}</span>}
            </label>
            <label className="label" htmlFor="endDate">
              End date
              <input className={inputClass} id="endDate" name="endDate" onChange={setField} required type="date" value={form.endDate} />
              {errors.endDate && <span className="mt-1 block text-sm text-rose-600">{errors.endDate}</span>}
            </label>
          </div>
        </section>

        <section className="card space-y-5">
          <h2 className="text-xl font-semibold text-slate-900">Audience</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label" htmlFor="expectedFootfall">
              Expected footfall
              <input className={inputClass} id="expectedFootfall" min="0" name="expectedFootfall" onChange={setField} required type="number" value={form.expectedFootfall} />
              {errors.expectedFootfall && <span className="mt-1 block text-sm text-rose-600">{errors.expectedFootfall}</span>}
            </label>
            <label className="label sm:col-span-2" htmlFor="audienceProfile">
              Audience profile
              <textarea className={inputClass} id="audienceProfile" name="audienceProfile" onChange={setField} required rows={3} value={form.audienceProfile} />
              {errors.audienceProfile && <span className="mt-1 block text-sm text-rose-600">{errors.audienceProfile}</span>}
            </label>
          </div>
        </section>

        {!isEditing && (
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 shadow-sm">
            <button
              aria-expanded={showAiPrefill}
              className="inline-flex items-center gap-2 font-semibold text-violet-800 hover:text-violet-950 focus-visible:outline-2 focus-visible:outline-violet-500"
              onClick={() => setShowAiPrefill((current) => !current)}
              type="button"
            >
              <svg aria-hidden="true" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
                <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
              </svg>
              Auto-fill from description (AI)
            </button>
            {showAiPrefill && (
              <div className="mt-3 space-y-3">
                <label className="label" htmlFor="ai-event-text">
                  Paste your event description or poster text
                  <textarea
                    className={inputClass}
                    id="ai-event-text"
                    maxLength={5000}
                    onChange={(event) => setAiText(event.target.value)}
                    rows={5}
                    value={aiText}
                  />
                </label>
                <p className="text-xs text-slate-500">{aiText.length}/5000 characters (minimum 30)</p>
                {aiError && <ErrorBox message={aiError} />}
                {aiFilled && (
                  <p className="text-sm font-medium text-emerald-700">
                    AI-filled. Please review every field before saving.
                  </p>
                )}
                <button
                  className="btn-secondary border-violet-200 text-violet-800 hover:bg-white"
                  disabled={aiLoading || aiText.trim().length < 30 || aiText.trim().length > 5000}
                  onClick={autoFillWithAI}
                  type="button"
                >
                  {aiLoading ? 'Filling...' : 'Auto-fill with AI'}
                </button>
              </div>
            )}
          </section>
        )}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Sponsorship tiers</h2>
            <button
              className="btn-secondary"
              disabled={form.tiers.length >= 6}
              onClick={addTier}
              type="button"
            >
              Add tier
            </button>
          </div>
          {errors.tiers && <p className="text-sm text-rose-600">{errors.tiers}</p>}
          {form.tiers.map((tier, index) => (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5" key={tier._id ?? `new-${index}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Tier {index + 1}</h3>
                {tier.slotsFilled > 0 && (
                  <span className="text-sm text-slate-500">{tier.slotsFilled} slots already taken</span>
                )}
                <button
                  className="btn-danger min-h-9 px-3 py-1.5"
                  disabled={tier.slotsFilled > 0}
                  onClick={() => removeTier(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['name', 'Name', 'text'],
                  ['price', 'Price (INR)', 'number'],
                  ['slots', 'Slots', 'number'],
                ].map(([name, label, type]) => (
                  <label className="label" htmlFor={`tier-${index}-${name}`} key={name}>
                    {label}
                    <input
                      className={inputClass}
                      disabled={name === 'price' && tier.slotsFilled > 0}
                      id={`tier-${index}-${name}`}
                      min={name === 'slots' ? '1' : name === 'price' ? '0' : undefined}
                      name={name}
                      onChange={(event) => setTierField(index, event)}
                      required
                      step={name === 'price' ? 'any' : undefined}
                      type={type}
                      value={tier[name]}
                    />
                    {tierErrorMessage(errorDetails, index, name) && (
                      <span className="mt-1 block text-sm text-rose-600">
                        {tierErrorMessage(errorDetails, index, name)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <label className="label" htmlFor={`tier-${index}-benefitsText`}>
                Benefits (one per line)
                <textarea
                  className={inputClass}
                  id={`tier-${index}-benefitsText`}
                  name="benefitsText"
                  onChange={(event) => setTierField(index, event)}
                  required
                  rows={3}
                  value={tier.benefitsText}
                />
                {tierErrorMessage(errorDetails, index, 'benefits') && (
                  <span className="mt-1 block text-sm text-rose-600">
                    {tierErrorMessage(errorDetails, index, 'benefits')}
                  </span>
                )}
              </label>
            </div>
          ))}
        </section>

        <button className="btn-primary w-full sm:w-auto" disabled={saving} type="submit">
          {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Create event'}
        </button>
      </form>

      {isEditing && (
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Event banner</h2>
          {bannerUrl && <img alt="Current event banner" className="max-h-64 rounded-2xl object-cover" src={bannerUrl} />}
          <label className="label" htmlFor="banner">
            Upload banner (JPEG, PNG, or WebP; maximum 5 MB)
            <input
              accept="image/jpeg,image/png,image/webp"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700"
              disabled={uploading}
              id="banner"
              onChange={uploadBanner}
              type="file"
            />
          </label>
          {uploading && <p className="text-sm text-slate-500">Uploading...</p>}
        </section>
      )}
    </section>
  );
}
