import './bars.css';

const Footer = () => {
    return (
        <footer className="footer grid justify-items-stretch content-center bg-black h-20 md:z-20">
            <p className="justify-self-center text-2xl">&copy; {new Date().getFullYear()} WeCommunicate</p>
        </footer>
    );
};

export default Footer;