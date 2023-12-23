function Contact() {
    return (
        <div className="grid justify-items-stretch content-center">
            <h1 className="text-5xl text-center">Contact Us</h1>
            <div className="justify-self-center p-4">
                <p className="mt-4">If you have any questions or feedback, feel free to get in touch with me!</p>
                <li className="mt-4">
                    <strong>Email:</strong> shohamkatzav95@gmail.com
                </li>
                <li>
                    <strong>Phone:</strong> 052-3292847
                </li>
                <li>
                    <strong>Linkedin: </strong>
                    <a href="https://www.linkedin.com/in/shoham-katzav/"
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline" target="_">Linkedin Profile</a>
                </li>
                <li>
                    <strong>Facebook: </strong>
                    <a href="https://www.facebook.com/shoham.katzav/"
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline" target="_">Facebook Profile</a>
                </li>
                <h2 className="text-3xl mt-4">GitHub</h2>
                <p className="mt-4">Explore more of my projects on my GitHub profile:</p>
                <div className="mt-4">
                    <a href="https://github.com/ShohamKatzav/"
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline" target="_">GitHub Profile</a>
                </div>
            </div >
        </div>
    );
}

export default Contact;