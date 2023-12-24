
const cron = require('node-cron');

const myCronJob = () => {
    cron.schedule('*/14 * * * *', () => {
        fetch(`${process.env.BASE_URL}/api/v1/wake-up`)
            .then(res => res.json())
            .then(data => console.log(data))
            .catch(err => console.error(err));
    }, {
        scheduled: true,
    });
};
module.exports = myCronJob;