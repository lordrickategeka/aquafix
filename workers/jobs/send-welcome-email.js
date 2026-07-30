const { sendMail } = require('../mail');
const welcomeEmail = require('../templates/welcome-email');

module.exports = async function sendWelcomeEmail({ email }) {
  await sendMail({ to: email, ...welcomeEmail({ email }) });
};
