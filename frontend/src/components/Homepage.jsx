import React from "react";
import { FaMapMarkerAlt, FaCamera, FaCheckCircle } from "react-icons/fa";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">CMRP</h1>
        <nav className="space-x-4">
          <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
          <a href="#about" className="text-gray-600 hover:text-gray-900">About</a>
          <a href="#contact" className="text-gray-600 hover:text-gray-900">Contact</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between p-8 md:p-16 bg-gradient-to-r from-blue-600 to-blue-400 text-white">
        <div className="md:w-1/2">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Civic Maintenance Reporting Platform</h2>
          <p className="mb-6 text-lg text-blue-100">
            Report civic issues with ease. Upload photos, add location, and track progress in real-time.
          </p>
          <a href="/report" className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold shadow hover:bg-blue-50">
            Report an Issue
          </a>
        </div>
        <div className="md:w-1/2 mt-8 md:mt-0">
          <img src="/assets/hero-image.png" alt="CMRP" className="w-full rounded-lg shadow-lg" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="p-8 md:p-16 bg-white">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-800">Key Features</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-lg transition">
            <FaCamera className="text-blue-600 text-4xl mb-4" />
            <h4 className="text-xl font-semibold mb-2">Photo Upload</h4>
            <p className="text-gray-600">Capture and upload images of the issue for better clarity.</p>
          </div>
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-lg transition">
            <FaMapMarkerAlt className="text-blue-600 text-4xl mb-4" />
            <h4 className="text-xl font-semibold mb-2">Geo-tagging</h4>
            <p className="text-gray-600">Automatically add the location of the reported issue.</p>
          </div>
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-lg transition">
            <FaCheckCircle className="text-blue-600 text-4xl mb-4" />
            <h4 className="text-xl font-semibold mb-2">Real-time Tracking</h4>
            <p className="text-gray-600">Track the progress of your report until it is resolved.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-800 text-gray-300 p-6 text-center">
        <p>© {new Date().getFullYear()} CMRP. All rights reserved.</p>
      </footer>
    </div>
  );
}
