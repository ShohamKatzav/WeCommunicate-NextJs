import React from 'react';

const About = () => {
    return (
        <div className="relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <main className="max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-800">About</span><br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-800">We-Communicate</span>
                        </h1>
                    </div>
                </main>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-12">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
                            My Mission
                        </h2>
                        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                In creating WeCommunicate, my vision was to bridge the gap in digital communication,
                                offering a platform that goes beyond traditional chat applications. It&apos;s a space where individuals can connect,
                                share, and engage in meaningful conversations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Technology Section */}
                <div className="py-12">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
                        Technology at the Core
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                title: "Next.js",
                                description: "Server-side rendering and efficient routing capabilities for seamless user experience."
                            },
                            {
                                title: "Tailwind CSS",
                                description: "Utility-first CSS framework for designing a responsive and aesthetically pleasing interface."
                            },
                            {
                                title: "Socket.IO",
                                description: "Enabling real-time communication and facilitating instant dynamic interactions."
                            },
                            {
                                title: "MongoDB",
                                description: "Scalable and flexible database handling for diverse data requirements."
                            }
                        ].map((tech, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
                                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-3">{tech.title}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{tech.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deployment Section */}
                <div className="py-12">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
                            Deployment with Render
                        </h2>
                        <div className="space-y-6">
                            {[
                                {
                                    title: "Environment Configuration",
                                    description: "Secure management of sensitive data through environment variables."
                                },
                                {
                                    title: "Scalability",
                                    description: "Auto-scaling capabilities for handling varying levels of traffic."
                                },
                                {
                                    title: "Socket.IO Support",
                                    description: "Reliable WebSocket support for real-time communication features."
                                }
                            ].map((item, index) => (
                                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:-translate-y-1 transition-transform duration-200">
                                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">{item.title}</h3>
                                    <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Journey Section */}
                <div className="py-12">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
                            My Journey as a Developer
                        </h2>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                                WeCommunicate is more than a project; it&apos;s a personal expedition through the realms of full-stack development.
                                From the initial concept to the final deployment, each phase has been a deep dive into the intricacies of web development.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                                This project was a gateway for me to explore new technologies like Next.js and Socket.IO while honing my skills in familiar ones.
                                It represents my continuous quest for knowledge and my unwavering passion for technology.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="py-12">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Your feedback and suggestions are vital to the growth and improvement of WeCommunicate.
                            I am always open to hearing your thoughts and experiences.
                        </p>
                        <a
                            href="/contact"
                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Get in Touch
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;