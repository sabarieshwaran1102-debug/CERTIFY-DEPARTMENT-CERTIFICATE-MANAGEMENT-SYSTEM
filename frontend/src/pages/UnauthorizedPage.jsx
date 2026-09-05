import { Link } from 'react-router-dom';

const UnauthorizedPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">403</h1>
                <p className="text-xl text-gray-600 mb-6">Unauthorized - You do not have access to this page</p>
                <Link to="/login" className="btn-primary">
                    Return to Login
                </Link>
            </div>
        </div>
    );
};

export default UnauthorizedPage;
