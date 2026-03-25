import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h1>
        <p className="text-gray-500 mb-6">
          This position may have been filled or removed. Check out our other open
          roles below.
        </p>
        <Link
          href="/jobs"
          className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          ← View All Open Positions
        </Link>
      </div>
    </div>
  );
}
