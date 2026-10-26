import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container page-body" style={{ textAlign: 'center', padding: '100px 0' }}>
      <h1>Page not found</h1>
      <p className="lead" style={{ margin: '0 auto 24px' }}>That page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Find speakers</Link>
    </div>
  )
}
