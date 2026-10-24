import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';

export default function Landing() {
  const [loading, setLoading] = useState(true);
  const [databaseStatus, setDatabaseStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    api
      .get('/health')
      .then(({ data }) => {
        setDatabaseStatus(data.db);
      })
      .catch((error) => {
        setErrorMessage(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Sponsorships that find the right fit</h1>
        <p className="max-w-2xl text-gray-700">
          Fynd connects small companies looking for visibility with event organizers seeking
          sponsors. It gives both sides a simple place to discover opportunities and build
          sponsorship partnerships.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Server status</h2>
        {loading && <Loader />}
        {!loading && errorMessage && <ErrorBox message={errorMessage} />}
        {!loading && !errorMessage && (
          <p className="text-sm text-green-700">Connected (db: {databaseStatus})</p>
        )}
      </div>
    </section>
  );
}
