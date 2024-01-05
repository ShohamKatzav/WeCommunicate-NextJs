"use client";
import { useEffect, useState } from "react";

const LocationAccessInformation = ({ information }: { information: string }) => {
    const [headerText, setHeaderText] = useState("");

    useEffect(() => {
        const text = information === 'prompt'
            ? "We're waiting for you to grant access to your location"
            : "Access to location service denied";
        setHeaderText(text);
    }, [information]);

    return (
        <div className="grid md:grid-cols-3">
            <div className="md:col-start-2">
                <div className="grid gap-4 justify-items-stretch content-center">
                    <h1 className="row-start-1 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl justify-self-center text-center">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r to-cyan-800 from-lime-500">
                            {headerText}
                        </span>
                    </h1>
                    <p className="md:row-start-3 row-start-2 text-xl text-center">
                        To use one of our newest features, sharing and viewing your friends&apos; locations, please allow access to location services in your browser settings.
                    </p>
                    <p className="md:row-start-4 row-start-3 text-xl text-center">
                        You can read more about how to enable location access on<br/><a href="https://support.google.com/chrome/answer/142065?hl=en"
                            className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline" target="_blank" rel="noopener noreferrer">
                            Google&apos;s sharing location guide
                        </a>.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LocationAccessInformation;