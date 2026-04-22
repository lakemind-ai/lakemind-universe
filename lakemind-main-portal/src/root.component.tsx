import React from "react";
import App from "./app";
import { ToastContainer } from "react-toastify";
import "./index.css";

const Root = (props) => {
  return (
    <div>
      <App />
      <ToastContainer
        position="bottom-left"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        className="text-sm font-['inter']"
        progressClassName="bg-primary"
      />
    </div>
  );
};

export default Root;
