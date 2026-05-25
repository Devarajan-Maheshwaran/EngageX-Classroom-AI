import React, { useState } from 'react';

const QuizModal = ({ quiz, onSubmit, onClose }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  if (!quiz) return null;

  const handleSubmit = () => {
    if (selectedOption !== null && onSubmit) {
      onSubmit(selectedOption);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-700">
        <div className="bg-indigo-600 p-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg">Knowledge Check</h2>
          <button onClick={onClose} className="text-indigo-200 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-lg text-white mb-6 font-medium">{quiz.question}</p>
          
          <div className="space-y-3">
            {quiz.options && quiz.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full text-left p-4 rounded-lg border ${selectedOption === idx ? 'bg-indigo-900 border-indigo-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 transition-colors'}`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className={`px-6 py-2 rounded-lg font-bold shadow-md transition-colors ${selectedOption !== null ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
            >
              Submit Answer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
