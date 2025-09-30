import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Layout from "./Layout.jsx";
import Home from "./pages/Home.jsx";
import Vote from "./pages/Vote.jsx";
import Results from "./pages/Results.jsx";
import Agenda from "./pages/Agenda.jsx";
import Season from "./pages/Season.jsx";
import Attendance from "./pages/Attendance.jsx";


const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/vote", element: <Vote /> },
      { path: "/results", element: <Results /> },
      { path: "/agenda", element: <Agenda /> },
      { path: "/season", element: <Season /> },
      { path: "/attendance", element: <Attendance /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
