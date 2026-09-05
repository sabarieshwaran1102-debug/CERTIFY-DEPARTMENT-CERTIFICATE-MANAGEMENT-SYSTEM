import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-6">Page not found</p>
                <Link to="/" className="btn-primary">
                    Go to Home
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;
