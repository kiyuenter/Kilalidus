import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-6 mt-10">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="mb-4">
          <a href="https://www.babypips.com" target="_blank" rel="noopener noreferrer" className="mx-2 hover:underline">BabyPips</a>
          <a href="https://www.investopedia.com" target="_blank" rel="noopener noreferrer" className="mx-2 hover:underline">Investopedia</a>
          <a href="https://www.myfxbook.com" target="_blank" rel="noopener noreferrer" className="mx-2 hover:underline">MyFXBook</a>
        </div>
        <p>©2025 Kilalidus. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
