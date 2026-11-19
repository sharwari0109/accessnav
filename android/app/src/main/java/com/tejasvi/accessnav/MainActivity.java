package com.tejasvi.accessnav;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}