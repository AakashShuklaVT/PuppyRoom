import GUI from 'lil-gui'

export default class Debug
{
    constructor()
    {
        this.active = window.location.hash === '#debug'

        if(false)
        {
            this.ui = new GUI()
        }
    }
}