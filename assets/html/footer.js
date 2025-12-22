const footer = (SUPPORT_MAIL,APP_NAME) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff; padding:0; margin-top:20px;">
  <tr>
    <td align="center" style="padding:20px 0 0 0;">
      
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto;">
        <tr>
          <td style="border-top:1px solid #e5e5e5; padding-top:16px;">

            <p style="
                margin:0;
                font-family: Arial, Helvetica, sans-serif;
                font-size:13px;
                color:#666666;
                line-height:20px;
                text-align:center;
            ">
              This is an automated message, please do not reply.  
              For support, contact:
              <a href="mailto:${SUPPORT_MAIL}" style="color:#3b82f6; text-decoration:none; font-weight:600;">${SUPPORT_MAIL}</a>
            </p>

            <p style="
                margin:10px 0 0 0;
                font-family: Arial, Helvetica, sans-serif;
                font-size:12px;
                color:#999999;
                text-align:center;
            ">
              © 2025 <strong>${APP_NAME}</strong>. All rights reserved.
            </p>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
`;

module.exports = footer;
