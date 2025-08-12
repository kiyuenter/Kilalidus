import React from 'react';

const AboutSection = () => {
  return (
    <section className="py-16 px-6 bg-gray-50">
      <h2 className="text-3xl font-bold text-center mb-6">About ICT Strategy & Trading</h2>
      <p className="max-w-3xl mx-auto text-lg text-gray-700 mb-4">
        The ICT (Inner Circle Trader) strategy is a professional trading methodology focusing on precision entries,
        market structure, and liquidity concepts. It emphasizes smart money concepts and timing the market for
        optimal entries.
      </p>
      <ul className="max-w-2xl mx-auto list-disc list-inside text-gray-600">
        <li>Understanding market sessions and timing</li>
        <li>Identifying liquidity pools and imbalances</li>
        <li>Using the Silver Bullet entry model</li>
        <li>Maintaining strict risk management rules</li>
      </ul>
    </section>
  );
};

export default AboutSection;
