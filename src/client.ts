import {connect} from 'ws';
connect('ws://localhost:3000', () => console.log('connected'))
