import React from "react";
import { Router, Route, Switch, Redirect } from "react-router-dom";
import { createBrowserHistory } from "history";
import { AppLayout } from "@/components/layout/applayout";
import { AuthGuard } from "@/components/auth/authguard";
import { LoginPage } from "@/components/auth/loginpage";
import { AuthCallback } from "@/components/auth/authcallback";
import HomePage from "@/components/home/homepage";
import { ScanPage } from "@/components/scan/scanpage";
import { EntityDetailPage } from "@/components/entity/entitydetailpage";
import { PublishPage } from "@/components/publish/publishpage";

const history = createBrowserHistory();

const App = () => {
  return (
    <Router history={history}>
      <Switch>
        <Route path="/login">
          <AppLayout requireAuth={false}>
            <LoginPage />
          </AppLayout>
        </Route>
        <Route path="/auth/callback">
          <AuthCallback />
        </Route>
        <Route path="/scan">
          <AppLayout>
            <ScanPage />
          </AppLayout>
        </Route>
        <Route path="/entity/:id">
          <AppLayout>
            <EntityDetailPage />
          </AppLayout>
        </Route>
        <Route path="/publish">
          <AppLayout>
            <PublishPage />
          </AppLayout>
        </Route>
        <Route exact path="/">
          <Redirect to="/scan" />
        </Route>
        <Route path="/">
          <AppLayout>
            <HomePage />
          </AppLayout>
        </Route>
      </Switch>
    </Router>
  );
};

export default App;
