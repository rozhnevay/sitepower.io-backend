# sitepower.io-backend
**Chat for site as a service platform.**

**Main  roles** of application users:

**`Customer`** - our (sitepower service) client, who have have own site and use our application for provide an oportunity to their clients 
chat with them. They register in our services, get js with a chat widget, and put this js on the own site.

**`Customer client`** - clients, who use sites of our customers, and want to conversate with site owner. They see a minimized chat button, 
click on it and do a conversation, asking about prices and so on.

**Pages**:

**`Login Page`** - opens on the start of application, if no auth cookie in user browser is 
found. There are input controls: **`Email`**, **`Pass`**. Buttons: **`Continue`**, **`Register`**
On **`Continue`** user authorizes, browser cookie set's on 24h
On **`Register`** user put email and pass, and new user creates in db, user authorizes, browser cookie set's on 24h
 
**`Chat Page`** - main page of application. There are two panels: left - list of **`conversations`** and right - **`active dialog`**.

**`Designer Page`** - here **`Customer`** can take their js to put on his own site.

 **Widget**:
 
 JS code, that executes on **`Customer`** site, when **`Customer client`** enter it. This code position **`Chat-minimized`** button
 on the left bottom with fixed position, on click  **`Chat-full`** window opens and **`Customer client`** doing a conversation with a **`Customer`**.
 After first message, new **`conversation`** creating and become visible in a **`Customer`** **`Chat Page`**. 