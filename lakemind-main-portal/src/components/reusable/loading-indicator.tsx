import { useEffect, useState } from "react";
import { usePromiseTracker } from "react-promise-tracker";
import { Loader } from "./loader";

const LoadingIndicator = () => {
  const { promiseInProgress } = usePromiseTracker();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (promiseInProgress) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [promiseInProgress]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F5F7FA]/60 backdrop-blur-sm">
      <Loader
        size="medium"
        message="Loading"
        textClassName="mt-2 text-sm text-[#4A5568]"
      />
    </div>
  );
};

export default LoadingIndicator;
