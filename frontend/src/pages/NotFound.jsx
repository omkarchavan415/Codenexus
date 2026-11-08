import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="p-6">
      <EmptyState title="That page does not exist" action={<Link className="btn btn-primary" to="/">Go to dashboard</Link>}>
        The link may be old or mistyped.
      </EmptyState>
    </div>
  );
}
