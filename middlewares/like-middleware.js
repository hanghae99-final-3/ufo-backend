const jwt = require("jsonwebtoken");
const { user } = require("../models");

module.exports = (req, res, next) => {
  const { authorization } = req.headers;
  if (
    authorization == null ||
    authorization == undefined ||
    authorization == "null"
  ) {
    res.locals.user = null;
    next();
    return;
  }

  const [tokenType, tokenValue] = authorization.split(" ");

  if (tokenType !== "Bearer") {
    res.status(401).send({
      errorMessage: "로그인이 필요합니다.",
    });
    return;
  }

  try {
    const myToken = verifyToken(tokenValue);
    if (myToken == "jwt expired") {
      // access token 만료
      const userInfo = jwt.decode(tokenValue, process.env.JWT_SECRET);
      const user_id = userInfo.user_id;
      let refresh_token;
      user.findOne({ where: user_id }).then((u) => {
        refresh_token = u.refresh_token;
        const myRefreshToken = verifyToken(refresh_token);
        if (myRefreshToken == "jwt expired") {
          res.send({ errorMessage: "로그인이 필요합니다." });
        } else {
          const myNewToken = jwt.sign(
            { user_id: u.user_id },
            process.env.JWT_SECRET,
            {
              expiresIn: process.env.JWT_ACCESS_EXPIRE,
            }
          );
          res.send({ message: "new token", myNewToken });
        }
      });
    } else {
      const { user_id } = jwt.verify(tokenValue, process.env.JWT_SECRET);
      user.findOne({ where: user_id }).then((u) => {
        res.locals.user = u;
        next();
      });
    }
  } catch (err) {
    res.send({ errorMessage: err + " : 로그인이 필요합니다." });
  }
};

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return error.message;
  }
}
