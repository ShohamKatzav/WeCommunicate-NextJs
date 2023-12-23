function About() {
    return (
        <div className="grid justify-items-stretch content-center break-words">
            <h1 className="text-5xl text-center">About We-Communicate</h1>
            <h2 className="mt-8 text-3xl text-center">My Mission</h2>
            <div className="justify-self-center overflow-visible p-4 md:w-1/3">
                <p className="mt-4">
                    In creating WeCommunicate, my vision was to bridge the gap in digital communication, offering a platform that goes beyond traditional chat applications. It's a space where individuals can connect, share, and engage in meaningful conversations.
                </p>
                <h2 className="mt-8 text-3xl text-center">Technology at the Core</h2>
                <p className="mt-4">
                    WeCommunicate is the culmination of my journey into the depths of full-stack development, a venture driven by a passion for exploring cutting-edge web technologies. Here are the key tools and technologies that bring my vision to life:
                </p>
                <li className="mt-4">
                <strong>Next.js: </strong> 
                    I chose Next.js for its server-side rendering and efficient routing capabilities, which are essential for a seamless user experience.
                </li>
                <li>
                    <strong>Tailwind CSS: </strong> 
                    This utility-first CSS framework is my tool of choice for designing a responsive and aesthetically pleasing user interface, thanks to its focus on productivity and customization.
                </li>
                <li>
                    <strong>Socket.IO: </strong> 
                    At the core of WeCommunicate is real-time communication, and Socket.IO enables this by facilitating instant and dynamic interactions.
                </li>
                <li>
                    <strong>Express.js: </strong> 
                    As a flexible server framework for Node.js, Express.js allows me to efficiently manage server-side logic and APIs.
                </li>
                <li>
                <strong>MongoDB: </strong> 
                I use MongoDB for its scalability and flexibility, which are crucial in handling the diverse data requirements of my application.
                </li>

                <h2 className="mt-8 text-3xl text-center">My Journey as a Developer</h2>
                <p className="mt-4">
                    WeCommunicate is more than a project; it's a personal expedition through the realms of full-stack development. From the initial concept to the final deployment, each phase has been a deep dive into the intricacies of web development.

                    This project was a gateway for me to explore new technologies like Next.js and Socket.IO while honing my skills in familiar ones. It represents my continuous quest for knowledge and my unwavering passion for technology.
                </p>

                <h2 className="mt-8 text-3xl text-center">Let's Connect</h2>
                <p className="mt-4">
                    Your feedback and suggestions are vital to the growth and improvement of WeCommunicate. I am always open to hearing your thoughts and experiences. Feel free to connect with me <a href="/contact"
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline">here</a> and join me on this exciting journey of making digital communication more engaging and accessible.
                </p>
            </div >
        </div>
    );
}

export default About;