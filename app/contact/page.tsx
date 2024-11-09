import React from 'react';
import { Mail, Phone, Linkedin, Facebook, Github } from 'lucide-react';

const Contact = () => {
    const contactMethods = [
        {
            icon: <Mail className="w-6 h-6" />,
            title: 'Email',
            value: 'shohamkatzav95@gmail.com',
            link: 'mailto:shohamkatzav95@gmail.com'
        },
        {
            icon: <Phone className="w-6 h-6" />,
            title: 'Phone',
            value: '052-3292847',
            link: 'tel:052-3292847'
        },
        {
            icon: <Linkedin className="w-6 h-6" />,
            title: 'LinkedIn',
            value: 'LinkedIn Profile',
            link: 'https://www.linkedin.com/in/shoham-katzav/'
        },
        {
            icon: <Facebook className="w-6 h-6" />,
            title: 'Facebook',
            value: 'Facebook Profile',
            link: 'https://www.facebook.com/shoham.katzav/'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            {/* Hero Section */}
            <div className="pt-4 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                            <span className="block">Get in Touch</span>
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300">
                            If you have any questions or feedback, feel free to reach out!
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact Methods Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {contactMethods.map((method, index) => (
                        <a
                            key={index}
                            href={method.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-all duration-200 flex items-center space-x-4"
                        >
                            <div className="flex-shrink-0">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors duration-200">
                                    {method.icon}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                    {method.title}
                                </h3>
                                <p className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                                    {method.value}
                                </p>
                            </div>
                        </a>
                    ))}
                </div>

                {/* GitHub Section */}
                <div className="mt-16 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
                            <Github className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Explore My Projects
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Check out my latest work and contributions on GitHub
                        </p>
                        <a
                            href="https://github.com/ShohamKatzav/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transform hover:scale-105 transition-all duration-200"
                        >
                            <span>Visit GitHub Profile</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;