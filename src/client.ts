import {Connection, Session} from 'autobahn';

const connection = new Connection({
    realm: 'com.kissfs.driver',
    url: 'ws://127.0.0.1:3000/',
});
connection.onopen = (session: Session) => {
    session.call('com.kissfs.test', ['asd']).then(resp => console.log(resp) )
};
connection.open()
