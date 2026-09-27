import { Fragment } from 'react';
import { Mail, Phone, Linkedin, Facebook, Github, Bug } from 'lucide-react';
import { getT } from '../i18n/server';
import { pageTitleClassName } from '../components/shell/pageTitle';
import PageTitle from '../components/shell/fitTitle';
import BugReportLauncher from '../components/bugReport/bugReportLauncher';

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
                        <PageTitle className={pageTitleClassName}>
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-cyan-800 dark:from-emerald-300 dark:to-cyan-400">{t('contact.title')}</span>
                        </PageTitle>
                        <p className="mt-4 max-w-2xl mx-auto text-xl text-muted-foreground">
                            {t('contact.intro')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact Methods Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                {/* Report a bug - its own block, first: the cards below are
                    for reaching Shoham, this one is for something that broke
                    and sends the details a fix needs along with it. */}
                <div className="mb-6 max-w-4xl mx-auto">
                    <div className="flex flex-col gap-4 rounded-lg border border-pink-200 bg-white p-4 shadow-lg dark:border-pink-400/30 dark:bg-gray-800 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                            <div className="shrink-0 rounded-full bg-pink-100 p-3 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                                <Bug className="w-6 h-6" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                    {t('bugReport.contactTitle')}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-300">
                                    {t('bugReport.contactBody')}
                                </p>
                            </div>
                        </div>
                        <BugReportLauncher
                            source="contact"
                            className="bug-report-wiggle inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-pink-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-pink-700 hover:shadow-lg active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:bg-pink-500 dark:text-gray-950 dark:hover:bg-pink-400 dark:focus-visible:ring-offset-gray-800"
                        >
                            <Bug className="bug-report-wiggle-icon w-5 h-5" aria-hidden="true" />
                            {t('bugReport.button')}
                        </BugReportLauncher>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {contactMethods.map((method, index) => (
                        <a
                            key={index}
                            href={method.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex min-w-0 items-center gap-3 rounded-lg border border-gray-300 bg-white p-4 shadow-lg transition-all duration-200 hover:scale-105 dark:border-gray-700 dark:bg-gray-800 sm:gap-4 sm:p-6"
                        >
                            <div className="shrink-0">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors duration-200">
                                    {method.icon}
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                    {method.title}
                                </h3>
                                <p className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                                    {/* An address or number reads left to right even
                                        inside a right-to-left page. On the narrowest
                                        phones an address may break after its "@" -
                                        never anywhere else. */}
                                    <bdi dir="ltr">{method.value.split('@').map((part, i, all) => (
                                        <Fragment key={i}>{part}{i < all.length - 1 && <>@<wbr /></>}</Fragment>
                                    ))}</bdi>
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