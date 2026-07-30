module.exports = function welcomeEmail({ email }) {
  return {
    subject: 'Welcome!',
    text: `Hi ${email},\n\nYour account has been created. Glad to have you on board.`,
    html: `<p>Hi ${email},</p><p>Your account has been created. Glad to have you on board.</p>`,
  };
};
