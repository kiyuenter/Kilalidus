import React, { useState, useEffect } from 'react';

const slides = [
  { img: 'https://images8.alphacoders.com/105/1052871.jpg', text: 'Master the Markets with Confidence' },
  { img: 'https://images5.alphacoders.com/135/thumb-1920-1357577.jpeg', text: 'Consistency is the Key to Profit' },
  { img: 'https://images7.alphacoders.com/138/thumb-1920-1388833.jpg', text: 'Trade Smart, Live Better' },
  { img: 'https://c1.wallpaperflare.com/preview/528/903/583/silhouette-father-and-son-sundown-chat.jpg', text: 'Your Strategy, Your Freedom' },
  { img: 'https://quotefancy.com/media/wallpaper/3840x2160/8153422-NEVER-GIVE-UP-Wallpaper.jpg', text: '' },
  { img: "https://e0.pxfuel.com/wallpapers/16/621/desktop-wallpaper-best-in-high-quality-google.jpg", text: 'Build Wealth Step by Step' },
];

const Slideshow = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <img src={slides[current].img} alt="slide" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
        <h1 className="text-white text-4xl md:text-6xl font-bold text-center px-4">{slides[current].text}</h1>
      </div>
    </div>
  );
};

export default Slideshow;
