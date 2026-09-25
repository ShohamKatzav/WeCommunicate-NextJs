import { Mail, Phone, Linkedin, Facebook, Github } from 'lucide-react';
import { getT } from '../i18n/server';
import { pageTitleClassName } from '../components/shell/pageTitle';

const Contact = async () => {
    const t = await getT();
    const contactMethods = [
        {
            icon: <Mail className="w-6 h-6" />,
            title: t('contact.email'),
            value: 'shohamkatzav95@gmail.com',
            link: 'mailto:shohamkatzav95@gmail.com'
        },
        {
            icon: <Phone className="w-6 h-6" />,
            title: t('contact.phone'),
            value: '+972 52-3292847',
            link: 'tel:+972523292847'
        },
        {
            icon: <Linkedin className="w-6 h-6" />,
            title: 'LinkedIn',
            value: t('contact.linkedinProfile'),
            link: 'https://www.linkedin.com/in/shoham-katzav/'
        },
        {
            icon: <Facebook className="w-6 h-6" />,
            title: 'Facebook',
            value: t('contact.facebookProfile'),
            link: 'https://www.facebook.com/shoham.katzav/'
        }
    ];

    return (
        <div>
            {/* Hero Section */}
            <div className="pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className={pageTitleClassName}>
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-cyan-800 dark:from-emerald-300 dark:to-cyan-400">{t('contact.title')}</span>
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-xl text-muted-foreground">
                            {t('contact.intro')}
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
                            className="group bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-6 transform hover:scale-105 transition-all duration-200 flex items-center gap-4"
                        >
                            <div className="shrink-0">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors duration-200">
                                    {method.icon}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                    {method.title}
                                </h3>
                                <p className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                                    {/* An address or number reads left to right even
                                        inside a right-to-left page. */}
                                    <bdi dir="ltr">{method.value}</bdi>
                                </p>
                            </div>
                        </a>
                    ))}
                </div>

                {/* GitHub Section */}
                <div className="mt-16 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-8 text-center">
                        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
                            <Github className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            {t('contact.projects')}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            {t('contact.projectsBody')}
                        </p>
                        <a
                            href="https://github.com/ShohamKatzav/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-8 py-3 bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-lg transform hover:scale-105 transition-all duration-200"
                        >
                            <span>{t('contact.visitGithub')}</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;