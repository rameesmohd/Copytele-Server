const dotenv = require('dotenv');
dotenv.config();
const footer = require("./footer");
const header = require("./header");
const APP_NAME = process.env.APP_NAME || "-"
const SUPPORT_MAIL = process.env.SUPPORT_MAIL || "-"

const emailTemplate = (body) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
      <style>
      /* Email clients support only limited CSS, so test thoroughly */
      .center-content {
        padding: 0 !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }

      /* Fallback for clients that don't support Flexbox */
      .fallback-center {
        text-align: center !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    </style>
  </head>
  
  <body>
    <div style="background-color: #ffffff !important;">
      <table
        width="100%"
        cellspacing="0"
        cellpadding="0"
        style="
          border-collapse: collapse !important;
          border-spacing: 0px !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background-repeat: repeat !important;
          background-position: center top !important;
          background-color: #ffffff !important;
        "
      >
        <tbody>
          <tr>
            <td class="fallback-center center-content" style="
            padding:0;
            margin:0;
            ">  
              <div style="display:flex!important;
            flex-direction: column!important;
            justify-content: center;
            align-items: center;!important">
              ${header(APP_NAME)}
              ${body}      
              ${footer(APP_NAME,SUPPORT_MAIL)}
        </div>
              </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`;

// Exporting everything from one file
module.exports = {
  emailTemplate,
};