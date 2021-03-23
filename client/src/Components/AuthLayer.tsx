import React, { Component } from 'react'
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import { authLayerProps } from '../TypeScript/App Interfaces';
import Category from './Category/Category';
import Home from './Home/Home';
import Header from './Layout/Header/Header';
import Login from './Login';
import Search from './Search/Search';
import { connect } from 'react-redux';
import { CheckUserAuth } from '../Redux/Actions/UserActions';
import PrivateRoute from './PrivateRoute';
import Settings from './Settings';

class AuthLayer extends Component<authLayerProps> {

    constructor (props:authLayerProps) {
        super(props)
    }
    
    componentWillMount() {
        this.props.CheckUserAuth();
    }

    render() {
        const { ATTEMPTEDAUTH, LOGGEDIN } = this.props;
        return (
            
            <Router>
            {ATTEMPTEDAUTH &&

                <div className="bg-white">
                <Header />
                <Switch>
                    <Route exact path='/search' component={Search} />
                    <Route exact path='/categories/:category' component={Category} />
                    <Route exact path='/' component={Home} />
                    <Route exact path='/login' component={Login} />
                    <PrivateRoute exact={true} path='/settings' component={Settings} LOGGEDIN={LOGGEDIN} />
                </Switch>
            </div>
            }
        </Router>
        )
    }
}

const mapStateToProps = (store:any) => {
    const { UserState } = store;
    const { LOGGEDIN, ATTEMPTEDAUTH } = UserState;
    return {
        LOGGEDIN,
        ATTEMPTEDAUTH
    }
}

const mapDispatchToProps = (dispatch:Function) => {
    return {
        CheckUserAuth: () => {dispatch(CheckUserAuth())}
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AuthLayer);