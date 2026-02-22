import './bars.css';

const Footer = () => {
    return (
        <footer className="footer grid justify-items-stretch content-center bg-black h-[10vh] md:h-[5vh] md:min-h-12 md:z-20">
            <p className="justify-self-center text-2xl">&copy; {new Date().getFullYear()} WeCommunicate</p>
        </footer>
    );
};

export default Footer;
