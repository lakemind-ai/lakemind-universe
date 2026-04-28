import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";

export default function HomePage() {
  const history = useHistory();

  useEffect(() => {
    history.replace("/scan");
  }, [history]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1E3A5F]" />
    </div>
  );
}
